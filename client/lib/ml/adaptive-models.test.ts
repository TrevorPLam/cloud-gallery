// AI-META-BEGIN
// AI-META: Comprehensive tests for adaptive model selection with device optimization
// OWNERSHIP: client/lib/ml
// ENTRYPOINTS: run by vitest during testing
// DEPENDENCIES: vitest, adaptive-models.ts, fast-check
// DANGER: Tests validate model selection algorithms and device capability detection
// CHANGE-SAFETY: Add new tests for additional model profiles and selection criteria
// TESTS: npm run test:watch
// AI-META-END

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fc from "fast-check";
import {
  AdaptiveModelSelector,
  ModelRegistry,
  getOptimalModel,
  autoConfigureModelManager,
  getModelRecommendations,
  cleanupAdaptiveModelSelector,
  resetAdaptiveModelSelectorForTesting,
  ModelVariant,
  ModelProfile,
  SelectionCriteria,
  AdaptiveSelectionResult,
  PerformanceMetrics,
} from "./adaptive-models";

// Mock dependencies
vi.mock("./tflite", () => ({
  getTensorFlowLiteManager: vi.fn(),
  GPUDelegateType: {
    CORE_ML: "core-ml",
    ANDROID_GPU: "android-gpu",
    NNAPI: "nnapi",
    NONE: "none",
  } as const,
}));

vi.mock("./model-manager", () => ({
  getModelManager: vi.fn(),
}));

vi.mock("react-native", () => ({
  Platform: {
    OS: "ios",
    Version: "15.0",
  },
}));

describe("ModelRegistry", () => {
  let registry: ModelRegistry;

  beforeEach(() => {
    registry = ModelRegistry.getInstance();
  });

  describe("profile management", () => {
    it("should have default profiles initialized", () => {
      const profiles = registry.getAllProfiles();

      expect(profiles.length).toBeGreaterThan(0);

      const profileNames = profiles.map((p) => p.baseName);
      expect(profileNames).toContain("mobilenet_v3");
      expect(profileNames).toContain("blazeface");
      expect(profileNames).toContain("efficientnet");
      expect(profileNames).toContain("facenet");
      expect(profileNames).toContain("clip");
    });

    it("should register new profiles", () => {
      const customProfile: ModelProfile = {
        baseName: "custom_model",
        variants: [
          {
            name: "custom_variant",
            path: "assets/models/custom.tflite",
            inputSize: 224,
            outputSize: 1000,
            quantized: true,
            complexity: "medium",
            accuracy: 0.85,
            speed: 0.6,
            memoryUsage: 20,
            description: "Custom model variant",
          },
        ],
        useCase: "object-detection",
        description: "Custom model for testing",
        tags: ["custom", "test"],
      };

      registry.registerProfile(customProfile);

      const retrieved = registry.getProfile("custom_model");
      expect(retrieved).toEqual(customProfile);
    });

    it("should get profiles by use case", () => {
      const objectDetectionProfiles =
        registry.getProfilesByUseCase("object-detection");
      const faceDetectionProfiles =
        registry.getProfilesByUseCase("face-detection");

      expect(objectDetectionProfiles.length).toBeGreaterThan(0);
      expect(faceDetectionProfiles.length).toBeGreaterThan(0);

      objectDetectionProfiles.forEach((profile) => {
        expect(profile.useCase).toBe("object-detection");
      });
    });

    it("should search profiles by query", () => {
      const mobileResults = registry.searchProfiles("mobile");
      const faceResults = registry.searchProfiles("face");

      expect(mobileResults.length).toBeGreaterThan(0);
      expect(faceResults.length).toBeGreaterThan(0);

      mobileResults.forEach((profile) => {
        const searchText =
          `${profile.baseName} ${profile.description} ${profile.tags.join(" ")}`.toLowerCase();
        expect(searchText).toContain("mobile");
      });
    });

    it("should get profiles by tags", () => {
      const mobileOptimized = registry.getProfilesByTags(["mobile-optimized"]);
      const realTime = registry.getProfilesByTags(["real-time"]);

      expect(mobileOptimized.length).toBeGreaterThan(0);
      expect(realTime.length).toBeGreaterThan(0);

      mobileOptimized.forEach((profile) => {
        expect(profile.tags).toContain("mobile-optimized");
      });
    });
  });
});

describe("AdaptiveModelSelector", () => {
  let selector: AdaptiveModelSelector;
  let mockTfliteManager: any;
  let mockModelManager: any;

  const mockDeviceCapabilities = {
    platform: "ios",
    memoryMB: 8192,
    supportedDelegates: ["core-ml", "none"],
    hasNeuralEngine: true,
    hasGPUAcceleration: true,
    cpuCores: 6,
  };

  beforeEach(() => {
    resetAdaptiveModelSelectorForTesting();
    selector = AdaptiveModelSelector.getInstance();

    mockTfliteManager = {
      getDeviceCapabilities: vi.fn().mockResolvedValue(mockDeviceCapabilities),
    };

    mockModelManager = {
      loadModel: vi.fn(),
      updateConfig: vi.fn(),
    };

    vi.mocked(require("./tflite").getTensorFlowLiteManager).mockReturnValue(
      mockTfliteManager,
    );
    vi.mocked(require("./model-manager").getModelManager).mockReturnValue(
      mockModelManager,
    );
  });

  afterEach(() => {
    cleanupAdaptiveModelSelector();
  });

  describe("initialization", () => {
    it("should initialize device capabilities", async () => {
      await selector.initialize();

      expect(mockTfliteManager.getDeviceCapabilities).toHaveBeenCalled();
    });

    it("should get device capability summary", async () => {
      await selector.initialize();

      const summary = selector.getDeviceCapabilitySummary();

      expect(summary).toBeDefined();
      expect(summary?.platform).toBe("ios");
      expect(summary?.memoryMB).toBe(8192);
      expect(summary?.supportedDelegates).toContain("core-ml");
      expect(summary?.hasNeuralEngine).toBe(true);
      expect(summary?.recommendedComplexity).toBeDefined();
    });
  });

  describe("model selection", () => {
    beforeEach(async () => {
      await selector.initialize();
    });

    it("should select optimal model for basic criteria", async () => {
      const result = await selector.selectModel("mobilenet_v3");

      expect(result).toBeDefined();
      expect(result.selectedVariant).toBeDefined();
      expect(result.reasoning).toBeDefined();
      expect(result.expectedPerformance).toBeDefined();
      expect(result.fallbackOptions).toBeDefined();
    });

    it("should select model with speed priority", async () => {
      const criteria: SelectionCriteria = {
        prioritizeSpeed: true,
        maxInferenceTime: 50,
      };

      const result = await selector.selectModel("mobilenet_v3", criteria);

      expect(result.selectedVariant.speed).toBeGreaterThan(0.7); // Should prefer fast variants
      expect(result.expectedPerformance.inferenceTime).toBeLessThanOrEqual(50);
    });

    it("should select model with accuracy priority", async () => {
      const criteria: SelectionCriteria = {
        prioritizeAccuracy: true,
        minAccuracy: 0.85,
      };

      const result = await selector.selectModel("mobilenet_v3", criteria);

      expect(result.selectedVariant.accuracy).toBeGreaterThanOrEqual(0.85);
    });

    it("should select model with memory priority", async () => {
      const criteria: SelectionCriteria = {
        prioritizeMemory: true,
        maxMemoryUsage: 10, // 10MB
      };

      const result = await selector.selectModel("mobilenet_v3", criteria);

      expect(result.selectedVariant.memoryUsage).toBeLessThanOrEqual(10);
      expect(result.selectedVariant.quantized).toBe(true); // Should prefer quantized models
    });

    it("should filter variants by constraints", async () => {
      const criteria: SelectionCriteria = {
        maxMemoryUsage: 5, // Very low memory limit
        minAccuracy: 0.9, // High accuracy requirement
      };

      // Should throw error if no variants meet constraints
      await expect(
        selector.selectModel("mobilenet_v3", criteria),
      ).rejects.toThrow();
    });

    it("should handle delegate preferences", async () => {
      const criteria: SelectionCriteria = {
        delegate: "core-ml",
      };

      const result = await selector.selectModel("mobilenet_v3", criteria);

      expect(result.selectedVariant.delegate).toBe("core-ml");
    });

    it("should provide fallback options", async () => {
      const result = await selector.selectModel("mobilenet_v3");

      expect(result.fallbackOptions.length).toBeGreaterThan(0);
      expect(result.fallbackOptions.length).toBeLessThanOrEqual(3); // Max 3 fallbacks
    });

    it("should generate meaningful reasoning", async () => {
      const criteria: SelectionCriteria = {
        prioritizeSpeed: true,
        prioritizeMemory: true,
      };

      const result = await selector.selectModel("mobilenet_v3", criteria);

      expect(result.reasoning.length).toBeGreaterThan(0);
      result.reasoning.forEach((reason) => {
        expect(reason.length).toBeGreaterThan(0);
      });
    });
  });

  describe("device capability filtering", () => {
    it("should filter variants for low memory devices", async () => {
      // Mock low memory device
      mockTfliteManager.getDeviceCapabilities.mockResolvedValue({
        ...mockDeviceCapabilities,
        memoryMB: 2048, // 2GB
      });

      await selector.initialize();

      const criteria: SelectionCriteria = {
        maxMemoryUsage: 500, // 500MB limit
      };

      const result = await selector.selectModel("mobilenet_v3", criteria);

      expect(result.selectedVariant.memoryUsage).toBeLessThanOrEqual(500);
    });

    it("should filter variants for devices without GPU acceleration", async () => {
      // Mock device without GPU
      mockTfliteManager.getDeviceCapabilities.mockResolvedValue({
        ...mockDeviceCapabilities,
        hasNeuralEngine: false,
        hasGPUAcceleration: false,
        supportedDelegates: ["none"],
      });

      await selector.initialize();

      const result = await selector.selectModel("mobilenet_v3");

      // Should not require GPU acceleration
      expect(result.selectedVariant.delegate).toBe("none");
    });

    it("should filter variants for Android devices", async () => {
      // Mock Android device
      mockTfliteManager.getDeviceCapabilities.mockResolvedValue({
        platform: "android",
        memoryMB: 6144,
        supportedDelegates: ["android-gpu", "nnapi", "none"],
        hasNeuralEngine: false,
        hasGPUAcceleration: true,
        cpuCores: 8,
      });

      await selector.initialize();

      const result = await selector.selectModel("mobilenet_v3");

      expect(result.selectedVariant.delegate).toMatch(/android-gpu|nnapi|none/);
    });
  });

  describe("performance tracking", () => {
    beforeEach(async () => {
      await selector.initialize();
    });

    it("should record performance metrics", () => {
      const metrics: PerformanceMetrics = {
        inferenceTime: 45,
        memoryUsage: 8.5,
        accuracy: 0.82,
        batteryImpact: "low",
        thermalImpact: "low",
      };

      selector.recordPerformance("mobilenet_v3_small_quant", metrics);

      const history = selector.getPerformanceHistory(
        "mobilenet_v3_small_quant",
      );
      expect(history).toHaveLength(1);
      expect(history[0]).toEqual(metrics);
    });

    it("should maintain performance history", () => {
      const metrics1: PerformanceMetrics = {
        inferenceTime: 40,
        memoryUsage: 8.0,
        accuracy: 0.81,
        batteryImpact: "low",
        thermalImpact: "low",
      };

      const metrics2: PerformanceMetrics = {
        inferenceTime: 42,
        memoryUsage: 8.2,
        accuracy: 0.83,
        batteryImpact: "low",
        thermalImpact: "low",
      };

      selector.recordPerformance("mobilenet_v3_small_quant", metrics1);
      selector.recordPerformance("mobilenet_v3_small_quant", metrics2);

      const history = selector.getPerformanceHistory(
        "mobilenet_v3_small_quant",
      );
      expect(history).toHaveLength(2);
      expect(history[0]).toEqual(metrics1);
      expect(history[1]).toEqual(metrics2);
    });

    it("should limit history size", () => {
      // Add 15 measurements (should keep only last 10)
      for (let i = 0; i < 15; i++) {
        selector.recordPerformance("test_model", {
          inferenceTime: 40 + i,
          memoryUsage: 8.0,
          accuracy: 0.8,
          batteryImpact: "low",
          thermalImpact: "low",
        });
      }

      const history = selector.getPerformanceHistory("test_model");
      expect(history).toHaveLength(10);
      expect(history[0].inferenceTime).toBe(5); // First kept measurement
      expect(history[9].inferenceTime).toBe(14); // Last measurement
    });

    it("should clear performance history", () => {
      selector.recordPerformance("test_model", {
        inferenceTime: 40,
        memoryUsage: 8.0,
        accuracy: 0.8,
        batteryImpact: "low",
        thermalImpact: "low",
      });

      expect(selector.getPerformanceHistory("test_model")).toHaveLength(1);

      selector.clearPerformanceHistory("test_model");

      expect(selector.getPerformanceHistory("test_model")).toHaveLength(0);
    });

    it("should clear all performance history", () => {
      selector.recordPerformance("model1", {
        inferenceTime: 40,
        memoryUsage: 8.0,
        accuracy: 0.8,
        batteryImpact: "low",
        thermalImpact: "low",
      });

      selector.recordPerformance("model2", {
        inferenceTime: 45,
        memoryUsage: 9.0,
        accuracy: 0.85,
        batteryImpact: "medium",
        thermalImpact: "low",
      });

      expect(selector.getPerformanceHistory("model1")).toHaveLength(1);
      expect(selector.getPerformanceHistory("model2")).toHaveLength(1);

      selector.clearPerformanceHistory();

      expect(selector.getPerformanceHistory("model1")).toHaveLength(0);
      expect(selector.getPerformanceHistory("model2")).toHaveLength(0);
    });
  });

  describe("performance estimation", () => {
    beforeEach(async () => {
      await selector.initialize();
    });

    it("should estimate performance for iOS with Neural Engine", async () => {
      const result = await selector.selectModel("mobilenet_v3");

      expect(result.expectedPerformance.inferenceTime).toBeLessThan(100);
      expect(result.expectedPerformance.batteryImpact).toMatch(
        /low|medium|high/,
      );
      expect(result.expectedPerformance.thermalImpact).toMatch(
        /low|medium|high/,
      );
    });

    it("should adjust performance based on delegate", async () => {
      const cpuResult = await selector.selectModel("mobilenet_v3", {
        delegate: "none",
      });
      const gpuResult = await selector.selectModel("mobilenet_v3", {
        delegate: "core-ml",
      });

      // GPU should be faster
      expect(gpuResult.expectedPerformance.inferenceTime).toBeLessThan(
        cpuResult.expectedPerformance.inferenceTime,
      );
    });

    it("should adjust performance based on quantization", async () => {
      const profile = ModelRegistry.getInstance().getProfile("mobilenet_v3")!;
      const quantizedVariant = profile.variants.find((v) => v.quantized)!;
      const floatVariant = profile.variants.find((v) => !v.quantized)!;

      // Quantized should be faster
      const quantizedPerf = selector["estimatePerformance"](quantizedVariant);
      const floatPerf = selector["estimatePerformance"](floatVariant);

      expect(quantizedPerf.inferenceTime).toBeLessThan(floatPerf.inferenceTime);
    });
  });
});

describe("Utility Functions", () => {
  let selector: AdaptiveModelSelector;
  let mockTfliteManager: any;
  let mockModelManager: any;

  beforeEach(() => {
    resetAdaptiveModelSelectorForTesting();
    selector = AdaptiveModelSelector.getInstance();

    mockTfliteManager = {
      getDeviceCapabilities: vi.fn().mockResolvedValue({
        platform: "ios",
        memoryMB: 8192,
        supportedDelegates: ["core-ml", "none"],
        hasNeuralEngine: true,
        hasGPUAcceleration: true,
        cpuCores: 6,
      }),
    };

    mockModelManager = {
      loadModel: vi.fn(),
      updateConfig: vi.fn(),
    };

    vi.mocked(require("./tflite").getTensorFlowLiteManager).mockReturnValue(
      mockTfliteManager,
    );
    vi.mocked(require("./model-manager").getModelManager).mockReturnValue(
      mockModelManager,
    );
  });

  afterEach(() => {
    cleanupAdaptiveModelSelector();
  });

  describe("getOptimalModel", () => {
    it("should get optimal model for use case", async () => {
      const result = await getOptimalModel("object-detection");

      expect(result).toBeDefined();
      expect(result.selectedVariant).toBeDefined();
      expect(result.reasoning).toBeDefined();
    });

    it("should throw error for unknown use case", async () => {
      await expect(getOptimalModel("unknown-use-case")).rejects.toThrow();
    });
  });

  describe("autoConfigureModelManager", () => {
    it("should configure model manager based on device capabilities", async () => {
      await autoConfigureModelManager();

      expect(mockModelManager.updateConfig).toHaveBeenCalled();

      const configCall = mockModelManager.updateConfig.mock.calls[0][0];
      expect(configCall).toHaveProperty("strategy");
      expect(configCall).toHaveProperty("maxMemoryMB");
      expect(configCall).toHaveProperty("maxModels");
    });

    it("should use conservative settings for low memory devices", async () => {
      // Mock low memory device
      mockTfliteManager.getDeviceCapabilities.mockResolvedValue({
        platform: "android",
        memoryMB: 2048,
        supportedDelegates: ["android-gpu", "none"],
        hasNeuralEngine: false,
        hasGPUAcceleration: true,
        cpuCores: 4,
      });

      await autoConfigureModelManager();

      const configCall = mockModelManager.updateConfig.mock.calls[0][0];
      expect(configCall.strategy).toBe("disk-priority");
      expect(configCall.maxMemoryMB).toBeLessThanOrEqual(128);
      expect(configCall.maxModels).toBeLessThanOrEqual(3);
    });

    it("should use aggressive settings for high-end devices", async () => {
      // Mock high-end device
      mockTfliteManager.getDeviceCapabilities.mockResolvedValue({
        platform: "ios",
        memoryMB: 16384,
        supportedDelegates: ["core-ml", "none"],
        hasNeuralEngine: true,
        hasGPUAcceleration: true,
        cpuCores: 8,
      });

      await autoConfigureModelManager();

      const configCall = mockModelManager.updateConfig.mock.calls[0][0];
      expect(configCall.strategy).toBe("aggressive");
      expect(configCall.maxMemoryMB).toBeGreaterThanOrEqual(256);
      expect(configCall.maxModels).toBeGreaterThanOrEqual(5);
    });
  });

  describe("getModelRecommendations", () => {
    it("should provide model recommendations", async () => {
      const recommendations = await getModelRecommendations();

      expect(recommendations).toHaveProperty("recommended");
      expect(recommendations).toHaveProperty("fallback");
      expect(recommendations.recommended.length).toBeGreaterThan(0);

      recommendations.recommended.forEach((rec) => {
        expect(rec).toHaveProperty("profile");
        expect(rec).toHaveProperty("variant");
        expect(rec).toHaveProperty("reason");
      });
    });
  });
});

describe("Property Tests", () => {
  describe("ModelRegistry", () => {
    it("Property 1: Profile consistency - registered profiles should be retrievable", async () => {
      await expect(
        fc.assert(
          fc.property(
            fc.string({ minLength: 1, maxLength: 20 }),
            fc.string({ minLength: 1, maxLength: 50 }),
            fc.array(fc.string(), { minLength: 1, maxLength: 3 }),
            fc.constant("object-detection" as const),
            (baseName, description, tags, useCase) => {
              const registry = ModelRegistry.getInstance();

              const profile: ModelProfile = {
                baseName,
                variants: [
                  {
                    name: `${baseName}_variant`,
                    path: "assets/models/test.tflite",
                    inputSize: 224,
                    outputSize: 1000,
                    quantized: true,
                    complexity: "medium" as const,
                    accuracy: 0.8,
                    speed: 0.6,
                    memoryUsage: 20,
                    description: "Test variant",
                  },
                ],
                useCase,
                description,
                tags,
              };

              registry.registerProfile(profile);

              const retrieved = registry.getProfile(baseName);
              expect(retrieved).toEqual(profile);

              // Cleanup
              registry["profiles"].delete(baseName);
            },
          ),
          { numRuns: 10 },
        ),
      ).resolves.toBeUndefined();
    });
  });

  describe("AdaptiveModelSelector", () => {
    it("Property 1: Selection score bounds - scores should be in [0,100]", async () => {
      await expect(
        fc.assert(
          fc.asyncProperty(
            fc.record({
              prioritizeSpeed: fc.boolean(),
              prioritizeAccuracy: fc.boolean(),
              prioritizeMemory: fc.boolean(),
              prioritizeBattery: fc.boolean(),
              maxInferenceTime: fc.option(fc.integer({ min: 10, max: 200 })),
              maxMemoryUsage: fc.option(fc.integer({ min: 1, max: 100 })),
              minAccuracy: fc.option(fc.float({ min: 0.1, max: 1.0 })),
            }),
            async (criteria) => {
              const selector = AdaptiveModelSelector.getInstance();

              // Mock device capabilities
              vi.mocked(
                require("./tflite").getTensorFlowLiteManager,
              ).mockReturnValue({
                getDeviceCapabilities: vi.fn().mockResolvedValue({
                  platform: "ios",
                  memoryMB: 8192,
                  supportedDelegates: ["core-ml", "none"],
                  hasNeuralEngine: true,
                  hasGPUAcceleration: true,
                  cpuCores: 6,
                }),
              });

              await selector.initialize();

              try {
                const result = await selector.selectModel(
                  "mobilenet_v3",
                  criteria,
                );
                const score = selector["scoreVariant"](
                  result.selectedVariant,
                  criteria,
                );

                expect(score).toBeGreaterThanOrEqual(0);
                expect(score).toBeLessThanOrEqual(100);
              } catch (error) {
                // Expected if no variants meet criteria
              }
            },
          ),
          { numRuns: 20 },
        ),
      ).resolves.toBeUndefined();
    });

    it("Property 2: Performance estimation bounds - estimated metrics should be reasonable", async () => {
      await expect(
        fc.assert(
          fc.asyncProperty(
            fc.record({
              name: fc.string(),
              path: fc.string(),
              inputSize: fc.integer({ min: 64, max: 512 }),
              outputSize: fc.integer({ min: 100, max: 2000 }),
              quantized: fc.boolean(),
              complexity: fc.constantFrom("low", "medium", "high") as any,
              accuracy: fc.float({ min: 0.5, max: 1.0 }),
              speed: fc.float({ min: 0.1, max: 1.0 }),
              memoryUsage: fc.integer({ min: 1, max: 200 }),
              description: fc.string(),
            }),
            async (variant) => {
              const selector = AdaptiveModelSelector.getInstance();

              // Mock device capabilities
              vi.mocked(
                require("./tflite").getTensorFlowLiteManager,
              ).mockReturnValue({
                getDeviceCapabilities: vi.fn().mockResolvedValue({
                  platform: "ios",
                  memoryMB: 8192,
                  supportedDelegates: ["core-ml", "none"],
                  hasNeuralEngine: true,
                  hasGPUAcceleration: true,
                  cpuCores: 6,
                }),
              });

              await selector.initialize();

              const performance = selector["estimatePerformance"](variant);

              expect(performance.inferenceTime).toBeGreaterThan(0);
              expect(performance.memoryUsage).toBeGreaterThan(0);
              expect(performance.accuracy).toBeGreaterThanOrEqual(0);
              expect(performance.accuracy).toBeLessThanOrEqual(1);
              expect(["low", "medium", "high"]).toContain(
                performance.batteryImpact,
              );
              expect(["low", "medium", "high"]).toContain(
                performance.thermalImpact,
              );
            },
          ),
          { numRuns: 15 },
        ),
      ).resolves.toBeUndefined();
    });
  });
});
