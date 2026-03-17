// AI-META-BEGIN
// AI-META: Comprehensive tests for model manager with caching and memory optimization
// OWNERSHIP: client/lib/ml
// ENTRYPOINTS: run by vitest during testing
// DEPENDENCIES: vitest, model-manager.ts, tflite.ts, fast-check
// DANGER: Tests validate caching behavior and memory management correctness
// CHANGE-SAFETY: Add new tests for additional cache strategies and loading patterns
// TESTS: npm run test:watch
// AI-META-END

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fc from "fast-check";
import {
  ModelManager,
  getModelManager,
  cleanupModelManager,
  resetModelManagerForTesting,
  CacheStrategy,
  LoadingProgress,
  ModelManagerStats,
} from "./model-manager";
import { ModelConfig, ModelMetadata, GPUDelegateType } from "./tflite";
import { createMockTFLiteManager } from "./__mocks__/tflite";

// Mock dependencies
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    multiRemove: vi.fn(),
  },
}));

vi.mock("./tflite", () => ({
  getTensorFlowLiteManager: vi.fn(() => createMockTFLiteManager()),
  GPUDelegateType: {
    CORE_ML: "core-ml",
    ANDROID_GPU: "android-gpu",
    NNAPI: "nnapi",
    NONE: "none",
  } as const,
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

describe("ModelManager", () => {
  let manager: ModelManager;
  let mockTfliteManager: any;

  const mockModelConfig: ModelConfig = {
    name: "test-model",
    path: "assets/models/test-model.tflite",
    inputSize: 224,
    outputSize: 1000,
  };

  const mockModelMetadata: ModelMetadata = {
    name: "test-model",
    version: "1.0.0",
    inputs: [
      {
        name: "input",
        shape: [1, 224, 224, 3],
        dataType: "uint8",
        size: 224 * 224 * 3,
      },
    ],
    outputs: [
      {
        name: "output",
        shape: [1, 1000],
        dataType: "float32",
        size: 1000 * 4,
      },
    ],
    delegate: "none",
    loadTime: 100,
    memoryUsage: 1024 * 1024, // 1MB
  };

  beforeEach(() => {
    resetModelManagerForTesting();
    manager = getModelManager();

    // Mock TensorFlow Lite manager
    mockTfliteManager = {
      getDeviceCapabilities: vi.fn().mockResolvedValue({
        platform: "ios",
        memoryMB: 8192,
        supportedDelegates: ["core-ml", "none"],
        hasNeuralEngine: true,
        hasGPUAcceleration: true,
        cpuCores: 6,
      }),
      loadModel: vi.fn().mockResolvedValue(mockModelMetadata),
      isModelLoaded: vi.fn().mockReturnValue(false),
      runInference: vi.fn().mockResolvedValue({ outputs: [[1, 2, 3]] }),
      getLoadedModels: vi.fn().mockReturnValue([]),
      getModelMetadata: vi.fn().mockReturnValue(mockModelMetadata),
      getPerformanceStats: vi.fn().mockReturnValue({
        loadedModels: 0,
        totalMemoryUsage: 0,
        supportedDelegates: ["core-ml", "none"],
      }),
      unloadModel: vi.fn(),
      unloadAllModels: vi.fn(),
    };

    vi.mocked(require("./tflite").getTensorFlowLiteManager).mockReturnValue(
      mockTfliteManager,
    );
  });

  afterEach(async () => {
    await cleanupModelManager();
  });

  describe("Initialization", () => {
    it("should create manager instance", () => {
      expect(manager).toBeDefined();
    });

    it("should initialize with default config", () => {
      const config = manager.getConfig();

      expect(config.strategy).toBe("adaptive");
      expect(config.maxMemoryMB).toBe(512);
      expect(config.maxModels).toBe(10);
      expect(config.backgroundLoading).toBe(true);
    });

    it("should initialize with custom config", () => {
      const customManager = getModelManager({
        strategy: "memory-only",
        maxMemoryMB: 256,
        maxModels: 5,
      });

      const config = customManager.getConfig();
      expect(config.strategy).toBe("memory-only");
      expect(config.maxMemoryMB).toBe(256);
      expect(config.maxModels).toBe(5);
    });

    it("should adjust config based on device capabilities", async () => {
      // Mock low memory device
      mockTfliteManager.getDeviceCapabilities.mockResolvedValue({
        platform: "android",
        memoryMB: 2048,
        supportedDelegates: ["android-gpu", "none"],
        hasNeuralEngine: false,
        hasGPUAcceleration: true,
        cpuCores: 4,
      });

      const lowMemoryManager = getModelManager();
      await new Promise((resolve) => setTimeout(resolve, 0)); // Wait for initialization

      const config = lowMemoryManager.getConfig();
      expect(config.maxMemoryMB).toBeLessThanOrEqual(128);
      expect(config.maxModels).toBeLessThanOrEqual(3);
    });
  });

  describe("Model Loading", () => {
    it("should load model successfully", async () => {
      const metadata = await manager.loadModel(mockModelConfig);

      expect(metadata).toBeDefined();
      expect(metadata.name).toBe("test-model");
      expect(mockTfliteManager.loadModel).toHaveBeenCalledWith(mockModelConfig);
    });

    it("should handle loading progress callbacks", async () => {
      const progressCallback = vi.fn();
      manager.onLoadingProgress(progressCallback);

      await manager.loadModel(mockModelConfig);

      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          modelName: "test-model",
          stage: "loading",
        }),
      );

      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          modelName: "test-model",
          stage: "ready",
          progress: 100,
        }),
      );
    });

    it("should cache loaded models", async () => {
      await manager.loadModel(mockModelConfig);

      // Load same model again
      const metadata = await manager.loadModel(mockModelConfig);

      expect(metadata.name).toBe("test-model");
      expect(mockTfliteManager.loadModel).toHaveBeenCalledTimes(1); // Called only once
    });

    it("should handle concurrent loading requests", async () => {
      const promises = Array(3)
        .fill(null)
        .map(() => manager.loadModel(mockModelConfig));
      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result.name).toBe("test-model");
      });
      expect(mockTfliteManager.loadModel).toHaveBeenCalledTimes(1);
    });

    it("should handle loading errors", async () => {
      mockTfliteManager.loadModel.mockRejectedValue(
        new Error("Model not found"),
      );

      await expect(manager.loadModel(mockModelConfig)).rejects.toThrow(
        "Model not found",
      );

      // Should notify error via progress callback
      const progressCallback = vi.fn();
      manager.onLoadingProgress(progressCallback);

      await expect(manager.loadModel(mockModelConfig)).rejects.toThrow();
      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          modelName: "test-model",
          stage: "error",
        }),
      );
    });
  });

  describe("Inference", () => {
    beforeEach(async () => {
      await manager.loadModel(mockModelConfig);
      mockTfliteManager.isModelLoaded.mockReturnValue(true);
    });

    it("should run inference successfully", async () => {
      const result = await manager.runInference("test-model", [
        new Uint8Array(224 * 224 * 3),
      ]);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(mockTfliteManager.runInference).toHaveBeenCalledWith(
        "test-model",
        [new Uint8Array(224 * 224 * 3)],
      );
    });

    it("should load model if not loaded", async () => {
      mockTfliteManager.isModelLoaded.mockReturnValue(false);

      const result = await manager.runInference(
        "test-model",
        [new Uint8Array(224 * 224 * 3)],
        mockModelConfig,
      );

      expect(result).toBeDefined();
      expect(mockTfliteManager.loadModel).toHaveBeenCalled();
      expect(mockTfliteManager.runInference).toHaveBeenCalled();
    });

    it("should throw error for unloaded model without config", async () => {
      mockTfliteManager.isModelLoaded.mockReturnValue(false);

      await expect(
        manager.runInference("unloaded-model", [new Uint8Array(224 * 224 * 3)]),
      ).rejects.toThrow(
        'Model "unloaded-model" not loaded and no config provided',
      );
    });

    it("should update statistics after inference", async () => {
      const statsBefore = await manager.getStats();

      await manager.runInference("test-model", [new Uint8Array(224 * 224 * 3)]);

      const statsAfter = await manager.getStats();
      expect(statsAfter.totalInferences).toBe(statsBefore.totalInferences + 1);
      expect(statsAfter.averageInferenceTime).toBeGreaterThan(0);
    });
  });

  describe("Cache Management", () => {
    it("should unload models", async () => {
      await manager.loadModel(mockModelConfig);
      mockTfliteManager.isModelLoaded.mockReturnValue(true);

      await manager.unloadModel("test-model");

      expect(mockTfliteManager.unloadModel).toHaveBeenCalledWith("test-model");
    });

    it("should unload all models", async () => {
      await manager.loadModel(mockModelConfig);
      await manager.loadModel({
        ...mockModelConfig,
        name: "test-model-2",
        path: "assets/models/test-model-2.tflite",
      });

      mockTfliteManager.isModelLoaded.mockReturnValue(true);
      mockTfliteManager.getLoadedModels.mockReturnValue([
        "test-model",
        "test-model-2",
      ]);

      await manager.unloadAllModels();

      expect(mockTfliteManager.unloadAllModels).toHaveBeenCalled();
    });

    it("should clear disk cache", async () => {
      const AsyncStorage =
        require("@react-native-async-storage/async-storage").default;

      await manager.clearDiskCache();

      expect(AsyncStorage.multiRemove).toHaveBeenCalled();
    });

    it("should optimize cache", async () => {
      const mockDate = new Date("2023-01-01");
      vi.spyOn(global, "Date").mockImplementation(() => mockDate.getTime());

      await manager.loadModel(mockModelConfig);

      // Simulate old models
      vi.spyOn(global, "Date").mockImplementation(() =>
        new Date("2023-01-15").getTime(),
      );

      await manager.optimizeCache();

      // Should identify and potentially unload old models
      expect(mockTfliteManager.unloadModel).toHaveBeenCalled();

      vi.restoreAllMocks();
    });
  });

  describe("Statistics and Monitoring", () => {
    it("should get comprehensive stats", async () => {
      await manager.loadModel(mockModelConfig);
      mockTfliteManager.isModelLoaded.mockReturnValue(true);
      mockTfliteManager.getLoadedModels.mockReturnValue(["test-model"]);
      mockTfliteManager.getPerformanceStats.mockReturnValue({
        loadedModels: 1,
        totalMemoryUsage: 1024 * 1024,
        supportedDelegates: ["core-ml", "none"],
      });

      await manager.runInference("test-model", [new Uint8Array(224 * 224 * 3)]);

      const stats = await manager.getStats();

      expect(stats.loadedModels).toBe(1);
      expect(stats.memoryUsageMB).toBeGreaterThan(0);
      expect(stats.totalInferences).toBe(1);
      expect(stats.averageInferenceTime).toBeGreaterThan(0);
      expect(stats.cacheHitRate).toBeGreaterThanOrEqual(0);
    });

    it("should calculate cache hit rate correctly", async () => {
      // First load - cache miss
      await manager.loadModel(mockModelConfig);

      // Second load - cache hit
      await manager.loadModel(mockModelConfig);

      const stats = await manager.getStats();
      expect(stats.cacheHitRate).toBe(0.5); // 1 hit out of 2 requests
    });
  });

  describe("Configuration Management", () => {
    it("should update configuration", async () => {
      const AsyncStorage =
        require("@react-native-async-storage/async-storage").default;

      await manager.updateConfig({
        strategy: "aggressive",
        maxMemoryMB: 1024,
        maxModels: 15,
      });

      const config = manager.getConfig();
      expect(config.strategy).toBe("aggressive");
      expect(config.maxMemoryMB).toBe(1024);
      expect(config.maxModels).toBe(15);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        "@ml_cache_config",
        expect.stringContaining("aggressive"),
      );
    });

    it("should handle configuration update errors gracefully", async () => {
      const AsyncStorage =
        require("@react-native-async-storage/async-storage").default;
      AsyncStorage.setItem.mockRejectedValue(new Error("Storage error"));

      // Should not throw error
      await expect(
        manager.updateConfig({ strategy: "memory-only" }),
      ).resolves.toBeUndefined();
    });
  });

  describe("Property Tests", () => {
    it("Property 1: Cache consistency - loaded models should match cache entries", async () => {
      await expect(
        fc.assert(
          fc.asyncProperty(
            fc.array(fc.string(), { minLength: 1, maxLength: 3 }),
            async (modelNames) => {
              // Load models
              for (const name of modelNames) {
                await manager.loadModel({
                  name,
                  path: `assets/models/${name}.tflite`,
                  inputSize: 224,
                  outputSize: 1000,
                });
              }

              const stats = await manager.getStats();
              expect(stats.loadedModels).toBe(modelNames.length);
            },
          ),
          { numRuns: 3 },
        ),
      ).resolves.toBeUndefined();
    });

    it("Property 2: Memory bounds - memory usage should be within configured limits", async () => {
      await expect(
        fc.assert(
          fc.asyncProperty(
            fc.integer({ min: 64, max: 512 }), // maxMemoryMB
            async (maxMemoryMB) => {
              const limitedManager = getModelManager({ maxMemoryMB });

              // Load models until memory limit is reached
              let totalMemory = 0;
              let modelsLoaded = 0;

              while (
                totalMemory < maxMemoryMB * 1024 * 1024 &&
                modelsLoaded < 5
              ) {
                const modelSize =
                  Math.floor(Math.random() * 50 + 10) * 1024 * 1024; // 10-60MB
                totalMemory += modelSize;

                mockTfliteManager.loadModel.mockResolvedValue({
                  ...mockModelMetadata,
                  name: `model-${modelsLoaded}`,
                  memoryUsage: modelSize,
                });

                try {
                  await limitedManager.loadModel({
                    name: `model-${modelsLoaded}`,
                    path: `assets/models/model-${modelsLoaded}.tflite`,
                    inputSize: 224,
                    outputSize: 1000,
                  });
                  modelsLoaded++;
                } catch (error) {
                  // Expected when memory limit is reached
                  break;
                }
              }

              const stats = await limitedManager.getStats();
              expect(stats.memoryUsageMB).toBeLessThanOrEqual(maxMemoryMB);
            },
          ),
          { numRuns: 5 },
        ),
      ).resolves.toBeUndefined();
    });

    it("Property 3: Statistics consistency - inference count should match actual calls", async () => {
      await expect(
        fc.assert(
          fc.asyncProperty(
            fc.integer({ min: 1, max: 10 }),
            async (inferenceCount) => {
              await manager.loadModel(mockModelConfig);
              mockTfliteManager.isModelLoaded.mockReturnValue(true);

              // Run inference multiple times
              for (let i = 0; i < inferenceCount; i++) {
                await manager.runInference("test-model", [
                  new Uint8Array(224 * 224 * 3),
                ]);
              }

              const stats = await manager.getStats();
              expect(stats.totalInferences).toBe(inferenceCount);
            },
          ),
          { numRuns: 5 },
        ),
      ).resolves.toBeUndefined();
    });
  });
});

describe("ModelManager Edge Cases", () => {
  let manager: ModelManager;

  beforeEach(() => {
    resetModelManagerForTesting();
    manager = getModelManager();
  });

  afterEach(async () => {
    await cleanupModelManager();
  });

  it("should handle memory pressure gracefully", async () => {
    const mockTfliteManager = {
      getDeviceCapabilities: vi.fn().mockResolvedValue({
        platform: "ios",
        memoryMB: 1024, // Low memory device
        supportedDelegates: ["none"],
        hasNeuralEngine: false,
        hasGPUAcceleration: false,
        cpuCores: 2,
      }),
      loadModel: vi.fn().mockResolvedValue({
        name: "test-model",
        memoryUsage: 800 * 1024 * 1024, // 800MB model
      }),
      isModelLoaded: vi.fn().mockReturnValue(false),
      runInference: vi.fn(),
      getLoadedModels: vi.fn().mockReturnValue([]),
      getModelMetadata: vi.fn(),
      getPerformanceStats: vi.fn().mockReturnValue({
        loadedModels: 0,
        totalMemoryUsage: 0,
        supportedDelegates: ["none"],
      }),
      unloadModel: vi.fn(),
      unloadAllModels: vi.fn(),
    };

    vi.mocked(require("./tflite").getTensorFlowLiteManager).mockReturnValue(
      mockTfliteManager,
    );

    const lowMemoryManager = getModelManager({ maxMemoryMB: 100 }); // 100MB limit

    // Should fail to load large model
    await expect(
      lowMemoryManager.loadModel({
        name: "large-model",
        path: "assets/models/large-model.tflite",
        inputSize: 224,
        outputSize: 1000,
      }),
    ).rejects.toThrow();
  });

  it("should handle cleanup during operations", async () => {
    const mockTfliteManager = {
      getDeviceCapabilities: vi.fn().mockResolvedValue({
        platform: "ios",
        memoryMB: 8192,
        supportedDelegates: ["core-ml"],
        hasNeuralEngine: true,
        hasGPUAcceleration: true,
        cpuCores: 6,
      }),
      loadModel: vi
        .fn()
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(resolve, 100)),
        ),
      isModelLoaded: vi.fn().mockReturnValue(false),
      runInference: vi.fn(),
      getLoadedModels: vi.fn().mockReturnValue([]),
      getModelMetadata: vi.fn(),
      getPerformanceStats: vi.fn().mockReturnValue({
        loadedModels: 0,
        totalMemoryUsage: 0,
        supportedDelegates: ["core-ml"],
      }),
      unloadModel: vi.fn(),
      unloadAllModels: vi.fn(),
    };

    vi.mocked(require("./tflite").getTensorFlowLiteManager).mockReturnValue(
      mockTfliteManager,
    );

    // Start loading model
    const loadingPromise = manager.loadModel({
      name: "slow-model",
      path: "assets/models/slow-model.tflite",
      inputSize: 224,
      outputSize: 1000,
    });

    // Cleanup while loading
    await manager.cleanup();

    // Loading should complete without throwing
    await expect(loadingPromise).resolves.toBeDefined();
  });

  it("should handle invalid configurations", async () => {
    const invalidConfigs = [
      { maxMemoryMB: -100 },
      { maxModels: 0 },
      { strategy: "invalid" as any },
    ];

    for (const config of invalidConfigs) {
      const invalidManager = getModelManager(config);
      const actualConfig = invalidManager.getConfig();

      // Should fall back to defaults for invalid values
      expect(actualConfig.maxMemoryMB).toBeGreaterThan(0);
      expect(actualConfig.maxModels).toBeGreaterThan(0);
      expect([
        "memory-only",
        "disk-priority",
        "adaptive",
        "aggressive",
      ]).toContain(actualConfig.strategy);
    }
  });
});
