// AI-META-BEGIN
// AI-META: Comprehensive tests for CLIP encoder with mocking and validation
// OWNERSHIP: client/lib/ml
// ENTRYPOINTS: imported by test runner and CI pipeline
// DEPENDENCIES: clip-embeddings.ts, vitest, React Native mocks
// DANGER: Model loading tests require proper mocking to avoid actual TFLite loading
// CHANGE-SAFETY: Add new test cases by extending describe blocks
// AI-META-END

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getCLIPEmbeddingsService,
  resetCLIPEmbeddingsServiceForTesting,
  CLIPEmbeddingsService,
  CLIP_MODELS,
} from "./clip-embeddings";

// Mock dependencies
vi.mock("@s77rt/react-native-sodium", () => ({
  sodium_init: vi.fn(() => 0),
  crypto_aead_xchacha20poly1305_ietf_encrypt: vi.fn(() => 0),
  crypto_aead_xchacha20poly1305_ietf_decrypt: vi.fn(() => 0),
  crypto_hmac_sha256: vi.fn(),
  crypto_hash_sha256: vi.fn(),
  randombytes_buf: vi.fn(),
}));

vi.mock("expo-image", () => ({
  Image: {
    getInfoAsync: vi.fn(),
  },
}));

vi.mock("expo-image-manipulator", () => ({
  manipulateAsync: vi.fn(),
  SaveFormat: {
    JPEG: "jpeg",
  },
}));

vi.mock("./model-manager", () => ({
  getModelManager: vi.fn(() => ({
    loadModel: vi.fn(),
    unloadModel: vi.fn(),
    runInference: vi.fn(),
    isModelLoaded: vi.fn(() => true),
    getStats: vi.fn(() => ({
      memoryUsageMB: 100,
      cacheHitRate: 0.85,
    })),
  })),
}));

vi.mock("./tflite", () => ({
  getTensorFlowLiteManager: vi.fn(() => ({
    getDeviceCapabilities: vi.fn(() => ({
      platform: "ios",
      hasNeuralEngine: true,
      hasGPUAcceleration: true,
      memoryMB: 1024,
      cpuCores: 6,
      supportedDelegates: ["core-ml", "none"],
    })),
  })),
}));

describe("CLIPEmbeddingsService", () => {
  let clipService: CLIPEmbeddingsService;

  beforeEach(() => {
    // Reset singleton before each test
    resetCLIPEmbeddingsServiceForTesting();
    clipService = getCLIPEmbeddingsService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Initialization", () => {
    it("should create singleton instance", () => {
      const service1 = getCLIPEmbeddingsService();
      const service2 = getCLIPEmbeddingsService();
      expect(service1).toBe(service2);
    });

    it("should have correct model configurations", () => {
      expect(CLIP_MODELS["clip-vit-b-32"]).toBeDefined();
      expect(CLIP_MODELS["clip-vit-b-32"].embeddingSize).toBe(512);
      expect(CLIP_MODELS["clip-vit-b-32"].imageSize).toBe(224);
      expect(CLIP_MODELS["clip-vit-b-32"].maxLength).toBe(77);
    });

    it("should initialize successfully", async () => {
      await clipService.initialize();
      expect(clipService.isReady()).toBe(true);
    });

    it("should handle initialization errors gracefully", async () => {
      const { getModelManager } = await import("./model-manager");
      vi.mocked(getModelManager).mockReturnValue({
        loadModel: vi.fn().mockRejectedValue(new Error("Model load failed")),
        unloadModel: vi.fn(),
        runInference: vi.fn(),
        isModelLoaded: vi.fn(() => false),
        getStats: vi.fn(),
      } as any);

      await expect(clipService.initialize()).rejects.toThrow("Model load failed");
    });
  });

  describe("Text Embeddings", () => {
    beforeEach(async () => {
      await clipService.initialize();
    });

    it("should generate text embeddings", async () => {
      const { getModelManager } = await import("./model-manager");
      const mockModelManager = vi.mocked(getModelManager()) as any;
      
      // Mock model inference to return realistic embeddings
      mockModelManager.runInference.mockResolvedValue([
        new Float32Array(512).fill(0.1), // Text embedding
        new Float32Array(512).fill(0.2), // Image embedding (unused)
      ]);

      const embeddings = await clipService.generateTextEmbeddings(["hello world"]);
      
      expect(embeddings).toHaveLength(1);
      expect(embeddings[0]).toBeInstanceOf(Float32Array);
      expect(embeddings[0].length).toBe(512);
      expect(mockModelManager.runInference).toHaveBeenCalledWith(
        "clip-vit-b-32",
        expect.any(Array)
      );
    });

    it("should handle multiple text inputs", async () => {
      const { getModelManager } = await import("./model-manager");
      const mockModelManager = vi.mocked(getModelManager()) as any;
      
      mockModelManager.runInference.mockResolvedValue([
        new Float32Array(512).fill(0.1),
      ]);

      const embeddings = await clipService.generateTextEmbeddings([
        "hello",
        "world",
        "test",
      ]);

      expect(embeddings).toHaveLength(3);
      expect(embeddings[0].length).toBe(512);
      expect(mockModelManager.runInference).toHaveBeenCalledTimes(3);
    });

    it("should handle empty text", async () => {
      const embeddings = await clipService.generateTextEmbeddings([""]);
      
      expect(embeddings).toHaveLength(1);
      expect(embeddings[0].length).toBe(512);
    });

    it("should handle long text by truncating", async () => {
      const { getModelManager } = await import("./model-manager");
      const mockModelManager = vi.mocked(getModelManager()) as any;
      
      mockModelManager.runInference.mockResolvedValue([
        new Float32Array(512).fill(0.1),
      ]);

      const longText = "a".repeat(1000);
      const embeddings = await clipService.generateTextEmbeddings([longText]);
      
      expect(embeddings).toHaveLength(1);
      expect(embeddings[0].length).toBe(512);
    });

    it("should handle tokenization errors gracefully", async () => {
      const { getModelManager } = await import("./model-manager");
      const mockModelManager = vi.mocked(getModelManager()) as any;
      
      mockModelManager.runInference.mockRejectedValue(new Error("Tokenization failed"));

      const embeddings = await clipService.generateTextEmbeddings(["test"]);
      
      expect(embeddings).toHaveLength(1);
      expect(embeddings[0]).toEqual(new Float32Array(512).fill(0)); // Zero embedding fallback
    });
  });

  describe("Image Embeddings", () => {
    beforeEach(async () => {
      await clipService.initialize();
    });

    it("should generate image embeddings", async () => {
      const { getModelManager } = await import("./model-manager");
      const { Image } = await import("expo-image");
      const { manipulateAsync } = await import("expo-image-manipulator");
      
      // Mock image info
      vi.mocked(Image.getInfoAsync).mockResolvedValue({
        width: 1024,
        height: 768,
      });

      // Mock image manipulation
      vi.mocked(manipulateAsync).mockResolvedValue({
        base64: Buffer.from("fake-image-data").toString("base64"),
      });

      // Mock model inference
      vi.mocked(getModelManager()).runInference.mockResolvedValue([
        new Float32Array(512).fill(0.1), // Text embedding (unused)
        new Float32Array(512).fill(0.2), // Image embedding
      ]);

      const embeddings = await clipService.generateImageEmbeddings(["file://test.jpg"]);
      
      expect(embeddings).toHaveLength(1);
      expect(embeddings[0]).toBeInstanceOf(Float32Array);
      expect(embeddings[0].length).toBe(512);
      expect(vi.mocked(manipulateAsync)).toHaveBeenCalledWith(
        "file://test.jpg",
        expect.arrayContaining([
          expect.objectContaining({ resize: { width: 224, height: 224 } }),
        ]),
        expect.objectContaining({
          format: "jpeg",
          base64: true,
          compress: 0.95,
        })
      );
    });

    it("should handle invalid image dimensions", async () => {
      const { Image } = await import("expo-image");
      
      vi.mocked(Image.getInfoAsync).mockResolvedValue({
        width: 0,
        height: 0,
      });

      await expect(
        clipService.generateImageEmbeddings(["file://invalid.jpg"])
      ).rejects.toThrow("Invalid image dimensions");
    });

    it("should handle image processing errors gracefully", async () => {
      const { Image } = await import("expo-image");
      const { manipulateAsync } = await import("expo-image-manipulator");
      
      vi.mocked(Image.getInfoAsync).mockResolvedValue({
        width: 1024,
        height: 768,
      });

      vi.mocked(manipulateAsync).mockRejectedValue(new Error("Processing failed"));

      const embeddings = await clipService.generateImageEmbeddings(["file://test.jpg"]);
      
      expect(embeddings).toHaveLength(1);
      expect(embeddings[0]).toEqual(new Float32Array(512).fill(0)); // Zero embedding fallback
    });

    it("should handle multiple image inputs", async () => {
      const { Image } = await import("expo-image");
      const { manipulateAsync } = await import("expo-image-manipulator");
      const { getModelManager } = await import("./model-manager");
      
      vi.mocked(Image.getInfoAsync).mockResolvedValue({
        width: 1024,
        height: 768,
      });

      vi.mocked(manipulateAsync).mockResolvedValue({
        base64: Buffer.from("fake-image-data").toString("base64"),
      });

      vi.mocked(getModelManager()).runInference.mockResolvedValue([
        new Float32Array(512).fill(0.1),
        new Float32Array(512).fill(0.2),
      ]);

      const embeddings = await clipService.generateImageEmbeddings([
        "file://test1.jpg",
        "file://test2.jpg",
      ]);

      expect(embeddings).toHaveLength(2);
      expect(embeddings[0].length).toBe(512);
      expect(embeddings[1].length).toBe(512);
    });
  });

  describe("Embedding Operations", () => {
    beforeEach(async () => {
      await clipService.initialize();
    });

    it("should calculate cosine similarity correctly", () => {
      const embedding1 = new Float32Array([1, 0, 0]);
      const embedding2 = new Float32Array([1, 0, 0]);
      const embedding3 = new Float32Array([0, 1, 0]);
      const embedding4 = new Float32Array([-1, 0, 0]);

      expect(clipService.cosineSimilarity(embedding1, embedding2)).toBeCloseTo(1);
      expect(clipService.cosineSimilarity(embedding1, embedding3)).toBeCloseTo(0);
      expect(clipService.cosineSimilarity(embedding1, embedding4)).toBeCloseTo(-1);
    });

    it("should handle zero vectors in cosine similarity", () => {
      const embedding1 = new Float32Array([0, 0, 0]);
      const embedding2 = new Float32Array([1, 0, 0]);

      expect(clipService.cosineSimilarity(embedding1, embedding2)).toBe(0);
    });

    it("should calculate Euclidean distance correctly", () => {
      const embedding1 = new Float32Array([0, 0, 0]);
      const embedding2 = new Float32Array([1, 0, 0]);
      const embedding3 = new Float32Array([0, 1, 0]);
      const embedding4 = new Float32Array([1, 1, 0]);

      expect(clipService.euclideanDistance(embedding1, embedding2)).toBeCloseTo(1);
      expect(clipService.euclideanDistance(embedding1, embedding3)).toBeCloseTo(1);
      expect(clipService.euclideanDistance(embedding1, embedding4)).toBeCloseTo(Math.sqrt(2));
    });

    it("should find similar embeddings correctly", () => {
      const queryEmbedding = new Float32Array([1, 0, 0]);
      const candidateEmbeddings = [
        new Float32Array([1, 0, 0]), // Perfect match
        new Float32Array([0, 1, 0]), // No similarity
        new Float32Array([0.9, 0.1, 0]), // High similarity
        new Float32Array([-1, 0, 0]), // Opposite
      ];

      const results = clipService.findSimilarEmbeddings(queryEmbedding, candidateEmbeddings, 3);

      expect(results).toHaveLength(3);
      expect(results[0].score).toBeCloseTo(1); // Perfect match
      expect(results[1].score).toBeGreaterThan(results[2].score); // High similarity > no similarity
      expect(results[0].rank).toBe(1);
      expect(results[1].rank).toBe(2);
      expect(results[2].rank).toBe(3);
    });

    it("should handle embedding dimension mismatch", () => {
      const embedding1 = new Float32Array([1, 0, 0]);
      const embedding2 = new Float32Array([1, 0]);

      expect(() => clipService.cosineSimilarity(embedding1, embedding2)).toThrow(
        "Embedding dimensions must match"
      );
      expect(() => clipService.euclideanDistance(embedding1, embedding2)).toThrow(
        "Embedding dimensions must match"
      );
    });
  });

  describe("Model Management", () => {
    beforeEach(async () => {
      await clipService.initialize();
    });

    it("should switch models correctly", async () => {
      const { getModelManager } = await import("./model-manager");
      const mockModelManager = vi.mocked(getModelManager()) as any;
      
      await clipService.switchModel("clip-vit-b-16");
      
      expect(clipService.getCurrentModel().name).toBe("clip-vit-b-16");
      expect(mockModelManager.unloadModel).toHaveBeenCalledWith("clip-vit-b-32");
      expect(mockModelManager.loadModel).toHaveBeenCalledWith(
        expect.objectContaining({ name: "clip-vit-b-16" }),
        "high"
      );
    });

    it("should handle invalid model names", async () => {
      await expect(clipService.switchModel("invalid-model")).rejects.toThrow(
        "Unknown CLIP model: invalid-model"
      );
    });

    it("should not switch to the same model", async () => {
      const { getModelManager } = await import("./model-manager");
      const mockModelManager = vi.mocked(getModelManager()) as any;
      
      await clipService.switchModel("clip-vit-b-32");
      
      expect(mockModelManager.unloadModel).not.toHaveBeenCalled();
      expect(mockModelManager.loadModel).not.toHaveBeenCalled();
    });

    it("should get available models", () => {
      const models = clipService.getAvailableModels();
      
      expect(models).toContain("clip-vit-b-32");
      expect(models).toContain("clip-vit-b-16");
      expect(models).toHaveLength(2);
    });

    it("should get current model configuration", () => {
      const config = clipService.getCurrentModel();
      
      expect(config.name).toBe("clip-vit-b-32");
      expect(config.embeddingSize).toBe(512);
      expect(config.imageSize).toBe(224);
    });
  });

  describe("Performance and Stats", () => {
    beforeEach(async () => {
      await clipService.initialize();
    });

    it("should return performance statistics", async () => {
      const { getModelManager } = await import("./model-manager");
      vi.mocked(getModelManager()).getStats.mockResolvedValue({
        memoryUsageMB: 150,
        cacheHitRate: 0.92,
      });

      const stats = await clipService.getStats();

      expect(stats.model).toBe("clip-vit-b-32");
      expect(stats.embeddingSize).toBe(512);
      expect(stats.isReady).toBe(true);
      expect(stats.memoryUsage).toBe(150);
      expect(stats.cacheHitRate).toBe(0.92);
    });
  });

  describe("Cleanup", () => {
    beforeEach(async () => {
      await clipService.initialize();
    });

    it("should cleanup resources correctly", async () => {
      const { getModelManager } = await import("./model-manager");
      const mockModelManager = vi.mocked(getModelManager()) as any;

      await clipService.cleanup();

      expect(mockModelManager.unloadModel).toHaveBeenCalledWith("clip-vit-b-32");
      expect(clipService.isReady()).toBe(false);
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle service not initialized", async () => {
      const service = new CLIPEmbeddingsService();
      
      await expect(service.generateTextEmbeddings(["test"])).rejects.toThrow(
        "CLIP service not initialized"
      );
      await expect(service.generateImageEmbeddings(["test.jpg"])).rejects.toThrow(
        "CLIP service not initialized"
      );
    });

    it("should handle empty input arrays", async () => {
      await clipService.initialize();
      
      const textEmbeddings = await clipService.generateTextEmbeddings([]);
      expect(textEmbeddings).toHaveLength(0);

      const imageEmbeddings = await clipService.generateImageEmbeddings([]);
      expect(imageEmbeddings).toHaveLength(0);
    });

    it("should handle very large text inputs", async () => {
      const { getModelManager } = await import("./model-manager");
      vi.mocked(getModelManager()).runInference.mockResolvedValue([
        new Float32Array(512).fill(0.1),
      ]);

      const largeText = "word ".repeat(10000);
      const embeddings = await clipService.generateTextEmbeddings([largeText]);
      
      expect(embeddings).toHaveLength(1);
      expect(embeddings[0].length).toBe(512);
    });
  });

  describe("Tokenization", () => {
    beforeEach(async () => {
      await clipService.initialize();
    });

    it("should tokenize common words correctly", async () => {
      const { getModelManager } = await import("./model-manager");
      const mockModelManager = vi.mocked(getModelManager()) as any;
      
      mockModelManager.runInference.mockImplementation((modelName, inputs) => {
        const tokens = inputs[0] as Int32Array;
        // Verify tokenization by checking tokens
        expect(tokens[0]).toBe(49406); // SOS token
        expect(tokens[tokens.length - 1]).toBe(49407); // EOS token
        
        return [new Float32Array(512).fill(0.1)];
      });

      await clipService.generateTextEmbeddings(["the beach sunset"]);
      
      expect(mockModelManager.runInference).toHaveBeenCalled();
    });

    it("should handle punctuation and special characters", async () => {
      const { getModelManager } = await import("./model-manager");
      const mockModelManager = vi.mocked(getModelManager()) as any;
      
      mockModelManager.runInference.mockResolvedValue([
        new Float32Array(512).fill(0.1),
      ]);

      await clipService.generateTextEmbeddings(["hello, world!"]);
      
      expect(mockModelManager.runInference).toHaveBeenCalled();
    });

    it("should pad tokens to correct length", async () => {
      const { getModelManager } = await import("./model-manager");
      const mockModelManager = vi.mocked(getModelManager()) as any;
      
      mockModelManager.runInference.mockImplementation((modelName, inputs) => {
        const tokens = inputs[0] as Int32Array;
        expect(tokens.length).toBe(77); // CLIP max length
        
        return [new Float32Array(512).fill(0.1)];
      });

      await clipService.generateTextEmbeddings(["short"]);
      
      expect(mockModelManager.runInference).toHaveBeenCalled();
    });
  });
});
