// AI-META-BEGIN
// AI-META: Comprehensive test suite for CLIP embeddings service with mocking and validation
// OWNERSHIP: client/lib/ml
// ENTRYPOINTS: run by test runner during CI/CD
// DEPENDENCIES: vitest, clip-embeddings.ts, model-manager.ts (mocked)
// DANGER: Model loading tests require proper mocking; embedding validation needs precision
// CHANGE-SAFETY: Add new model variants by extending test fixtures
// TESTS: All CLIP functionality including error handling and edge cases
// AI-META-END

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getCLIPEmbeddingsService,
  resetCLIPEmbeddingsServiceForTesting,
  CLIP_MODELS,
  CLIPEmbeddingsService,
  Float32Array,
} from "./clip-embeddings";
import { createMockTFLiteManager } from "./__mocks__/tflite";

// Mock dependencies
vi.mock("./model-manager", () => ({
  getModelManager: vi.fn(() => ({
    loadModel: vi.fn().mockResolvedValue({
      name: "clip-vit-b-32",
      embeddingSize: 512,
      inputSize: 224,
      outputSize: 512,
    }),
    runInference: vi.fn(),
    isModelLoaded: vi.fn().mockReturnValue(true),
    getPerformanceMetrics: vi.fn().mockReturnValue({
      averageInferenceTime: 45.5,
      memoryUsage: 1024 * 1024,
    }),
  })),
}));

vi.mock("./tflite", () => ({
  getTensorFlowLiteManager: vi.fn(() => createMockTFLiteManager()),
}));

// Mock React Native
vi.mock("react-native", () => ({
  Platform: {
    OS: "ios",
    Version: "15.0",
  },
  InteractionManager: {
    runAfterInteractions: vi.fn((callback) => callback()),
  },
}));

describe("CLIPEmbeddingsService", () => {
  let service: CLIPEmbeddingsService;

  beforeEach(() => {
    resetCLIPEmbeddingsServiceForTesting();
    service = getCLIPEmbeddingsService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Initialization", () => {
    it("should initialize with default model", () => {
      expect(service.getCurrentModel().name).toBe("clip-vit-b-32");
      expect(service.getCurrentModel().embeddingSize).toBe(512);
    });

    it("should have available models", () => {
      const models = service.getAvailableModels();
      expect(models).toContain("clip-vit-b-32");
      expect(models).toContain("clip-vit-b-16");
    });

    it("should check readiness status", () => {
      expect(service.isReady()).toBe(true);
    });
  });

  describe("Text Embeddings", () => {
    it("should generate text embeddings", async () => {
      const texts = ["hello world", "test query"];

      // Mock the model manager to return realistic embeddings
      const mockModelManager = (
        await import("./model-manager")
      ).getModelManager();
      mockModelManager.runInference.mockResolvedValue([
        new Float32Array(512).fill(0.1), // text embedding
        new Float32Array(512).fill(0.2), // image embedding (not used)
      ]);

      const embeddings = await service.generateTextEmbeddings(texts);

      expect(embeddings).toHaveLength(2);
      expect(embeddings[0]).toBeInstanceOf(Float32Array);
      expect(embeddings[0].length).toBe(512);
      expect(mockModelManager.runInference).toHaveBeenCalledTimes(2);
    });

    it("should handle empty text array", async () => {
      const embeddings = await service.generateTextEmbeddings([]);
      expect(embeddings).toHaveLength(0);
    });

    it("should handle text generation errors gracefully", async () => {
      const mockModelManager = (
        await import("./model-manager")
      ).getModelManager();
      mockModelManager.runInference.mockRejectedValue(
        new Error("Model inference failed"),
      );

      const embeddings = await service.generateTextEmbeddings(["test"]);

      expect(embeddings).toHaveLength(1);
      expect(embeddings[0]).toEqual(new Float32Array(512).fill(0)); // Zero embedding fallback
    });

    it("should tokenize text correctly", async () => {
      const texts = ["simple test"];

      const mockModelManager = (
        await import("./model-manager")
      ).getModelManager();
      mockModelManager.runInference.mockImplementation(
        async (modelName, inputs) => {
          // Verify tokenization by checking input format
          const tokens = inputs[0] as Int32Array;
          expect(tokens.length).toBeGreaterThan(0);
          expect(tokens[0]).toBe(49406); // SOS token

          return [new Float32Array(512).fill(0.1)];
        },
      );

      await service.generateTextEmbeddings(texts);

      expect(mockModelManager.runInference).toHaveBeenCalled();
    });
  });

  describe("Image Embeddings", () => {
    it("should generate image embeddings", async () => {
      const imageUris = ["file:///test/image1.jpg", "file:///test/image2.jpg"];

      const mockModelManager = (
        await import("./model-manager")
      ).getModelManager();
      mockModelManager.runInference.mockResolvedValue([
        new Float32Array(512).fill(0.1), // text embedding
        new Float32Array(512).fill(0.3), // image embedding
      ]);

      const embeddings = await service.generateImageEmbeddings(imageUris);

      expect(embeddings).toHaveLength(2);
      expect(embeddings[0]).toBeInstanceOf(Float32Array);
      expect(embeddings[0].length).toBe(512);
      expect(mockModelManager.runInference).toHaveBeenCalledTimes(2);
    });

    it("should handle empty image URI array", async () => {
      const embeddings = await service.generateImageEmbeddings([]);
      expect(embeddings).toHaveLength(0);
    });

    it("should handle image generation errors gracefully", async () => {
      const mockModelManager = (
        await import("./model-manager")
      ).getModelManager();
      mockModelManager.runInference.mockRejectedValue(
        new Error("Image processing failed"),
      );

      const embeddings = await service.generateImageEmbeddings([
        "file:///test/image.jpg",
      ]);

      expect(embeddings).toHaveLength(1);
      expect(embeddings[0]).toEqual(new Float32Array(512).fill(0)); // Zero embedding fallback
    });
  });

  describe("Embedding Operations", () => {
    it("should calculate cosine similarity correctly", () => {
      const embedding1 = new Float32Array([1, 0, 0]);
      const embedding2 = new Float32Array([1, 0, 0]);
      const embedding3 = new Float32Array([0, 1, 0]);

      const similarity1 = service.cosineSimilarity(embedding1, embedding2);
      const similarity2 = service.cosineSimilarity(embedding1, embedding3);

      expect(similarity1).toBeCloseTo(1.0, 5);
      expect(similarity2).toBeCloseTo(0.0, 5);
    });

    it("should calculate Euclidean distance correctly", () => {
      const embedding1 = new Float32Array([1, 0, 0]);
      const embedding2 = new Float32Array([0, 1, 0]);
      const embedding3 = new Float32Array([1, 0, 0]);

      const distance1 = service.euclideanDistance(embedding1, embedding2);
      const distance2 = service.euclideanDistance(embedding1, embedding3);

      expect(distance1).toBeCloseTo(Math.sqrt(2), 5);
      expect(distance2).toBeCloseTo(0.0, 5);
    });

    it("should find similar embeddings correctly", () => {
      const queryEmbedding = new Float32Array([1, 0, 0]);
      const candidateEmbeddings = [
        new Float32Array([1, 0, 0]), // Perfect match
        new Float32Array([0.9, 0.1, 0]), // High similarity
        new Float32Array([0, 1, 0]), // No similarity
        new Float32Array([0.8, 0.2, 0]), // Medium similarity
      ];

      const similarities = service.findSimilarEmbeddings(
        queryEmbedding,
        candidateEmbeddings,
        3,
      );

      expect(similarities).toHaveLength(3);
      expect(similarities[0].score).toBeCloseTo(1.0, 5);
      expect(similarities[0].rank).toBe(1);
      expect(similarities[1].score).toBeGreaterThan(similarities[2].score);
      expect(similarities[1].rank).toBe(2);
      expect(similarities[2].rank).toBe(3);
    });

    it("should handle embedding dimension mismatch", () => {
      const embedding1 = new Float32Array([1, 0, 0]);
      const embedding2 = new Float32Array([1, 0]);

      expect(() => {
        service.cosineSimilarity(embedding1, embedding2);
      }).toThrow("Embedding dimensions must match");

      expect(() => {
        service.euclideanDistance(embedding1, embedding2);
      }).toThrow("Embedding dimensions must match");
    });
  });

  describe("Model Management", () => {
    it("should switch models correctly", async () => {
      const mockModelManager = (
        await import("./model-manager")
      ).getModelManager();

      await service.switchModel("clip-vit-b-16");

      expect(service.getCurrentModel().name).toBe("clip-vit-b-16");
      expect(mockModelManager.unloadModel).toHaveBeenCalledWith(
        "clip-vit-b-32",
      );
      expect(mockModelManager.loadModel).toHaveBeenCalled();
    });

    it("should handle invalid model name", async () => {
      await expect(service.switchModel("invalid-model")).rejects.toThrow(
        "Unknown CLIP model",
      );
    });

    it("should not reload same model", async () => {
      const mockModelManager = (
        await import("./model-manager")
      ).getModelManager();

      await service.switchModel("clip-vit-b-32");

      expect(mockModelManager.unloadModel).not.toHaveBeenCalled();
      expect(mockModelManager.loadModel).not.toHaveBeenCalled();
    });
  });

  describe("Statistics and Monitoring", () => {
    it("should return performance statistics", async () => {
      const mockModelManager = (
        await import("./model-manager")
      ).getModelManager();
      mockModelManager.getStats.mockResolvedValue({
        loadedModels: 1,
        memoryUsageMB: 150,
        cacheHitRate: 0.85,
      });

      const stats = await service.getStats();

      expect(stats.model).toBe("clip-vit-b-32");
      expect(stats.embeddingSize).toBe(512);
      expect(stats.isReady).toBe(true);
      expect(stats.memoryUsage).toBe(150);
      expect(stats.cacheHitRate).toBe(0.85);
    });
  });

  describe("Error Handling", () => {
    it("should handle service not initialized error", async () => {
      // Create a new service instance without initialization
      const uninitializedService = new CLIPEmbeddingsService();

      await expect(
        uninitializedService.generateTextEmbeddings(["test"]),
      ).rejects.toThrow("CLIP service not initialized");
    });

    it("should handle embedding generation failures", async () => {
      const mockModelManager = (
        await import("./model-manager")
      ).getModelManager();
      mockModelManager.runInference.mockRejectedValue(
        new Error("GPU delegate failed"),
      );

      const embeddings = await service.generateTextEmbeddings(["test"]);

      // Should return zero embedding as fallback
      expect(embeddings).toHaveLength(1);
      expect(embeddings[0]).toEqual(new Float32Array(512).fill(0));
    });
  });

  describe("Normalization", () => {
    it("should normalize embeddings correctly", () => {
      const embedding = new Float32Array([3, 4]); // Should normalize to [0.6, 0.8]
      const expectedNorm = 5; // sqrt(3^2 + 4^2)

      // Access private method through prototype for testing
      const normalizeEmbedding = (service as any).normalizeEmbedding.bind(
        service,
      );
      normalizeEmbedding(embedding);

      expect(embedding[0]).toBeCloseTo(0.6, 5);
      expect(embedding[1]).toBeCloseTo(0.8, 5);

      // Verify unit length
      const norm = Math.sqrt(embedding[0] ** 2 + embedding[1] ** 2);
      expect(norm).toBeCloseTo(1.0, 5);
    });

    it("should handle zero vectors", () => {
      const embedding = new Float32Array([0, 0, 0]);

      const normalizeEmbedding = (service as any).normalizeEmbedding.bind(
        service,
      );
      normalizeEmbedding(embedding);

      // Zero vector should remain zero
      expect(Array.from(embedding)).toEqual([0, 0, 0]);
    });
  });

  describe("Tokenization", () => {
    it("should tokenize text with SOS and EOS tokens", async () => {
      const mockModelManager = (
        await import("./model-manager")
      ).getModelManager();
      let capturedTokens: Int32Array | null = null;

      mockModelManager.runInference.mockImplementation(async (_, inputs) => {
        capturedTokens = inputs[0] as Int32Array;
        return [new Float32Array(512).fill(0.1)];
      });

      await service.generateTextEmbeddings(["test"]);

      expect(capturedTokens).not.toBeNull();
      expect(capturedTokens![0]).toBe(49406); // SOS token
      expect(capturedTokens![capturedTokens!.length - 1]).toBe(49407); // EOS token
    });

    it("should respect maximum sequence length", async () => {
      const mockModelManager = (
        await import("./model-manager")
      ).getModelManager();
      let capturedTokens: Int32Array | null = null;

      mockModelManager.runInference.mockImplementation(async (_, inputs) => {
        capturedTokens = inputs[0] as Int32Array;
        return [new Float32Array(512).fill(0.1)];
      });

      // Create a very long text that should be truncated
      const longText = "a".repeat(200);
      await service.generateTextEmbeddings([longText]);

      expect(capturedTokens).not.toBeNull();
      expect(capturedTokens!.length).toBeLessThanOrEqual(77); // Max length
    });
  });

  describe("Integration with Model Manager", () => {
    it("should use correct delegate for iOS with Neural Engine", async () => {
      const mockTfliteManager = (
        await import("./tflite")
      ).getTensorFlowLiteManager();
      mockTfliteManager.getDeviceCapabilities.mockResolvedValue({
        platform: "ios",
        hasNeuralEngine: true,
        hasGPUAcceleration: true,
        memoryMB: 4096,
        cpuCores: 6,
        supportedDelegates: ["core-ml", "android-gpu", "none"],
      });

      const mockModelManager = (
        await import("./model-manager")
      ).getModelManager();

      // Create new service to trigger delegate selection
      resetCLIPEmbeddingsServiceForTesting();
      const newService = getCLIPEmbeddingsService();

      // Wait for initialization
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockModelManager.loadModel).toHaveBeenCalledWith(
        expect.objectContaining({
          delegate: "core-ml",
        }),
        "high",
      );
    });

    it("should use correct delegate for Android with GPU", async () => {
      const mockTfliteManager = (
        await import("./tflite")
      ).getTensorFlowLiteManager();
      mockTfliteManager.getDeviceCapabilities.mockResolvedValue({
        platform: "android",
        hasNeuralEngine: false,
        hasGPUAcceleration: true,
        memoryMB: 6144,
        cpuCores: 8,
        supportedDelegates: ["android-gpu", "nnapi", "none"],
      });

      const mockModelManager = (
        await import("./model-manager")
      ).getModelManager();

      resetCLIPEmbeddingsServiceForTesting();
      const newService = getCLIPEmbeddingsService();

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockModelManager.loadModel).toHaveBeenCalledWith(
        expect.objectContaining({
          delegate: "android-gpu",
        }),
        "high",
      );
    });
  });

  describe("Memory Management", () => {
    it("should handle large embedding arrays efficiently", async () => {
      const largeTexts = Array(100).fill(
        "large text query for testing memory efficiency",
      );

      const mockModelManager = (
        await import("./model-manager")
      ).getModelManager();
      mockModelManager.runInference.mockResolvedValue([
        new Float32Array(512).fill(0.1),
        new Float32Array(512).fill(0.2),
      ]);

      const startTime = Date.now();
      const embeddings = await service.generateTextEmbeddings(largeTexts);
      const endTime = Date.now();

      expect(embeddings).toHaveLength(100);
      expect(embeddings[0].length).toBe(512);

      // Should complete reasonably quickly (less than 1 second for 100 embeddings)
      expect(endTime - startTime).toBeLessThan(1000);
    });
  });

  describe("Cleanup", () => {
    it("should cleanup resources properly", async () => {
      const mockModelManager = (
        await import("./model-manager")
      ).getModelManager();

      await service.cleanup();

      expect(mockModelManager.unloadModel).toHaveBeenCalled();
      expect(service.isReady()).toBe(false);
    });
  });
});

describe("CLIP Models Configuration", () => {
  it("should have valid model configurations", () => {
    expect(CLIP_MODELS["clip-vit-b-32"]).toMatchObject({
      name: "clip-vit-b-32",
      embeddingSize: 512,
      maxLength: 77,
      imageSize: 224,
      quantized: true,
      normalizeFeatures: true,
    });

    expect(CLIP_MODELS["clip-vit-b-16"]).toMatchObject({
      name: "clip-vit-b-16",
      embeddingSize: 512,
      maxLength: 77,
      imageSize: 224,
      quantized: true,
      normalizeFeatures: true,
    });
  });

  it("should have required model paths", () => {
    expect(CLIP_MODELS["clip-vit-b-32"].path).toBeDefined();
    expect(CLIP_MODELS["clip-vit-b-16"].path).toBeDefined();
  });

  it("should have consistent embedding sizes", () => {
    const models = Object.values(CLIP_MODELS);
    const embeddingSizes = models.map((model) => model.embeddingSize);

    // All models should have the same embedding size for compatibility
    expect(new Set(embeddingSizes).size).toBe(1);
  });
});
